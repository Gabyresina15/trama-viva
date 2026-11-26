#![no_std]
//! TramaVivaContract — registro de piezas artesanales certificadas por una Sala y
//! reparto atómico de apoyos (USDC vía SAC) entre la Sala y la Artesana autora,
//! con custodia en el propio contrato cuando la artesana aún no tiene trustline.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token::TokenClient,
    Address, BytesN, Env, Symbol,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_BUMP_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;
const INSTANCE_BUMP_TO: u32 = 30 * DAY_IN_LEDGERS;
const PERSISTENT_BUMP_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const PERSISTENT_BUMP_TO: u32 = 120 * DAY_IN_LEDGERS;
/// Ventana anti doble clic (~30 s con ledgers de ~5 s).
pub const RECENT_SUPPORT_LEDGERS: u32 = 6;
pub const MAX_BPS: u32 = 10_000;
const BPS_DENOMINATOR: i128 = 10_000;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Token,
    TotalPending,
    Piece(Symbol),
    PendingBalance(Address),
    RecentSupport(Address, Symbol),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Piece {
    pub sala: Address,
    pub artisan: Address,
    pub passport_hash: BytesN<32>,
    pub artisan_bps: u32,
    pub total_supported: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub admin: Address,
    pub token: Address,
    pub total_pending: i128,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    InvalidBps = 1,
    InvalidAmount = 2,
    PieceNotFound = 3,
    PieceAlreadyRegistered = 4,
    DuplicateSupport = 5,
    NothingToClaim = 6,
    Overflow = 7,
    PendingEscrowNotEmpty = 8,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PieceRegistered {
    #[topic]
    pub piece_id: Symbol,
    #[topic]
    pub sala: Address,
    pub artisan: Address,
    pub passport_hash: BytesN<32>,
    pub artisan_bps: u32,
    pub updated: bool,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PieceSupported {
    #[topic]
    pub piece_id: Symbol,
    #[topic]
    pub supporter: Address,
    pub sala: Address,
    pub artisan: Address,
    pub token: Address,
    pub amount: i128,
    pub artisan_amount: i128,
    pub sala_amount: i128,
    pub hold_in_escrow: bool,
    pub passport_hash: BytesN<32>,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EarningsClaimed {
    #[topic]
    pub artisan: Address,
    pub token: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenUpdated {
    #[topic]
    pub admin: Address,
    pub old_token: Address,
    pub new_token: Address,
}

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_TO);
}

fn bump_persistent(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, PERSISTENT_BUMP_THRESHOLD, PERSISTENT_BUMP_TO);
}

fn admin(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Admin).unwrap()
}

fn token(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Token).unwrap()
}

fn total_pending(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get(&DataKey::TotalPending)
        .unwrap_or(0)
}

/// Reparto entero sin pérdida: `artisan + sala == amount` siempre (el resto del
/// redondeo hacia abajo queda en la parte de la Sala).
pub fn split_amount(amount: i128, artisan_bps: u32) -> Result<(i128, i128), Error> {
    if amount <= 0 {
        return Err(Error::InvalidAmount);
    }
    if artisan_bps > MAX_BPS {
        return Err(Error::InvalidBps);
    }
    let artisan_amount = amount
        .checked_mul(artisan_bps as i128)
        .ok_or(Error::Overflow)?
        / BPS_DENOMINATOR;
    let sala_amount = amount.checked_sub(artisan_amount).ok_or(Error::Overflow)?;
    Ok((artisan_amount, sala_amount))
}

#[contract]
pub struct TramaVivaContract;

#[contractimpl]
impl TramaVivaContract {
    pub fn __constructor(env: Env, admin: Address, token: Address) {
        let storage = env.storage().instance();
        storage.set(&DataKey::Admin, &admin);
        storage.set(&DataKey::Token, &token);
        storage.set(&DataKey::TotalPending, &0i128);
        bump_instance(&env);
    }

    /// Cambia el token SAC (ej. USDC de Circle ↔ XLM nativo de respaldo).
    /// Solo el admin, y solo si no hay saldo custodiado en el token actual.
    pub fn set_token(env: Env, new_token: Address) -> Result<(), Error> {
        let admin = admin(&env);
        admin.require_auth();
        if total_pending(&env) != 0 {
            return Err(Error::PendingEscrowNotEmpty);
        }
        let old_token = token(&env);
        env.storage().instance().set(&DataKey::Token, &new_token);
        bump_instance(&env);
        TokenUpdated {
            admin,
            old_token,
            new_token,
        }
        .publish(&env);
        Ok(())
    }

    /// Registra (o actualiza, si es la misma Sala) una pieza certificada.
    pub fn register_piece(
        env: Env,
        sala: Address,
        piece_id: Symbol,
        artisan: Address,
        passport_hash: BytesN<32>,
        artisan_bps: u32,
    ) -> Result<(), Error> {
        sala.require_auth();
        if artisan_bps > MAX_BPS {
            return Err(Error::InvalidBps);
        }
        let key = DataKey::Piece(piece_id.clone());
        let existing: Option<Piece> = env.storage().persistent().get(&key);
        let (total_supported, updated) = match existing {
            Some(prev) if prev.sala != sala => return Err(Error::PieceAlreadyRegistered),
            Some(prev) => (prev.total_supported, true),
            None => (0, false),
        };
        let piece = Piece {
            sala: sala.clone(),
            artisan: artisan.clone(),
            passport_hash: passport_hash.clone(),
            artisan_bps,
            total_supported,
        };
        env.storage().persistent().set(&key, &piece);
        bump_persistent(&env, &key);
        bump_instance(&env);
        PieceRegistered {
            piece_id,
            sala,
            artisan,
            passport_hash,
            artisan_bps,
            updated,
        }
        .publish(&env);
        Ok(())
    }

    /// Apoyo atómico: parte de la Sala directo a su cuenta y parte de la Artesana
    /// directo o custodiada en el contrato. Devuelve `(artisan_amount, sala_amount)`.
    pub fn support_piece(
        env: Env,
        supporter: Address,
        piece_id: Symbol,
        amount: i128,
        hold_in_escrow: bool,
    ) -> Result<(i128, i128), Error> {
        supporter.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let piece_key = DataKey::Piece(piece_id.clone());
        let mut piece: Piece = env
            .storage()
            .persistent()
            .get(&piece_key)
            .ok_or(Error::PieceNotFound)?;

        let now = env.ledger().sequence();
        let recent_key = DataKey::RecentSupport(supporter.clone(), piece_id.clone());
        if let Some(until) = env.storage().temporary().get::<_, u32>(&recent_key) {
            if now <= until {
                return Err(Error::DuplicateSupport);
            }
        }

        let (artisan_amount, sala_amount) = split_amount(amount, piece.artisan_bps)?;

        piece.total_supported = piece
            .total_supported
            .checked_add(amount)
            .ok_or(Error::Overflow)?;
        env.storage().persistent().set(&piece_key, &piece);
        bump_persistent(&env, &piece_key);

        let escrowed = hold_in_escrow && artisan_amount > 0;
        if escrowed {
            let pending_key = DataKey::PendingBalance(piece.artisan.clone());
            let pending: i128 = env.storage().persistent().get(&pending_key).unwrap_or(0);
            let pending = pending.checked_add(artisan_amount).ok_or(Error::Overflow)?;
            env.storage().persistent().set(&pending_key, &pending);
            bump_persistent(&env, &pending_key);
            let total = total_pending(&env)
                .checked_add(artisan_amount)
                .ok_or(Error::Overflow)?;
            env.storage().instance().set(&DataKey::TotalPending, &total);
        }

        let until = now.saturating_add(RECENT_SUPPORT_LEDGERS);
        env.storage().temporary().set(&recent_key, &until);
        env.storage()
            .temporary()
            .extend_ttl(&recent_key, RECENT_SUPPORT_LEDGERS, RECENT_SUPPORT_LEDGERS);
        bump_instance(&env);

        let token_addr = token(&env);
        let token = TokenClient::new(&env, &token_addr);
        if sala_amount > 0 {
            token.transfer(&supporter, &piece.sala, &sala_amount);
        }
        if artisan_amount > 0 {
            if escrowed {
                token.transfer(&supporter, &env.current_contract_address(), &artisan_amount);
            } else {
                token.transfer(&supporter, &piece.artisan, &artisan_amount);
            }
        }

        PieceSupported {
            piece_id,
            supporter,
            sala: piece.sala,
            artisan: piece.artisan,
            token: token_addr,
            amount,
            artisan_amount,
            sala_amount,
            hold_in_escrow: escrowed,
            passport_hash: piece.passport_hash,
        }
        .publish(&env);
        Ok((artisan_amount, sala_amount))
    }

    /// La artesana retira el 100 % de su saldo custodiado.
    pub fn claim(env: Env, artisan: Address) -> Result<i128, Error> {
        artisan.require_auth();
        let key = DataKey::PendingBalance(artisan.clone());
        let amount: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if amount <= 0 {
            return Err(Error::NothingToClaim);
        }
        env.storage().persistent().set(&key, &0i128);
        bump_persistent(&env, &key);
        let total = total_pending(&env)
            .checked_sub(amount)
            .ok_or(Error::Overflow)?;
        env.storage().instance().set(&DataKey::TotalPending, &total);
        bump_instance(&env);

        let token_addr = token(&env);
        TokenClient::new(&env, &token_addr).transfer(
            &env.current_contract_address(),
            &artisan,
            &amount,
        );
        EarningsClaimed {
            artisan,
            token: token_addr,
            amount,
        }
        .publish(&env);
        Ok(amount)
    }

    pub fn get_piece(env: Env, piece_id: Symbol) -> Option<Piece> {
        env.storage().persistent().get(&DataKey::Piece(piece_id))
    }

    pub fn get_pending_balance(env: Env, artisan: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::PendingBalance(artisan))
            .unwrap_or(0)
    }

    pub fn get_config(env: Env) -> Config {
        Config {
            admin: admin(&env),
            token: token(&env),
            total_pending: total_pending(&env),
        }
    }
}

mod test;
