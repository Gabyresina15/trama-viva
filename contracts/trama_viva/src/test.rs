#![cfg(test)]
extern crate std;

use crate::{
    split_amount, Error, PieceRegistered, PieceSupported, TramaVivaContract,
    TramaVivaContractClient, MAX_BPS, RECENT_SUPPORT_LEDGERS,
};
use soroban_sdk::{
    symbol_short,
    testutils::{
        storage::Persistent as _, Address as _, Events as _, Ledger as _, MockAuth,
        MockAuthInvoke,
    },
    token::{StellarAssetClient, TokenClient},
    Address, BytesN, Env, Event as _, IntoVal, Symbol,
};

const USDC: i128 = 10_000_000;

struct Setup<'a> {
    env: Env,
    admin: Address,
    sala: Address,
    artisan: Address,
    supporter: Address,
    token: TokenClient<'a>,
    contract_id: Address,
    client: TramaVivaContractClient<'a>,
}

fn setup() -> Setup<'static> {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let sala = Address::generate(&env);
    let artisan = Address::generate(&env);
    let supporter = Address::generate(&env);

    let sac = env.register_stellar_asset_contract_v2(issuer);
    let token_id = sac.address();
    StellarAssetClient::new(&env, &token_id).mint(&supporter, &(1_000 * USDC));

    let contract_id = env.register(TramaVivaContract, (admin.clone(), token_id.clone()));
    let client = TramaVivaContractClient::new(&env, &contract_id);
    let token = TokenClient::new(&env, &token_id);
    Setup {
        env,
        admin,
        sala,
        artisan,
        supporter,
        token,
        contract_id,
        client,
    }
}

fn hash(env: &Env, byte: u8) -> BytesN<32> {
    BytesN::from_array(env, &[byte; 32])
}

fn register(s: &Setup, piece_id: &Symbol, bps: u32) {
    s.client
        .register_piece(&s.sala, piece_id, &s.artisan, &hash(&s.env, 7), &bps);
}

fn advance_ledgers(env: &Env, n: u32) {
    env.ledger().with_mut(|l| l.sequence_number += n);
}

#[test]
fn constructor_sets_config_and_register_stores_piece() {
    let s = setup();
    let config = s.client.get_config();
    assert_eq!(config.admin, s.admin);
    assert_eq!(config.token, s.token.address);
    assert_eq!(config.total_pending, 0);

    let piece_id = symbol_short!("pieza_01");
    register(&s, &piece_id, 8_500);

    // La Sala autorizó exactamente esta invocación.
    let auths = s.env.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, s.sala);

    let expected = PieceRegistered {
        piece_id: piece_id.clone(),
        sala: s.sala.clone(),
        artisan: s.artisan.clone(),
        passport_hash: hash(&s.env, 7),
        artisan_bps: 8_500,
        updated: false,
    };
    assert!(s
        .env
        .events()
        .all()
        .events()
        .contains(&expected.to_xdr(&s.env, &s.contract_id)));

    let piece = s.client.get_piece(&piece_id).unwrap();
    assert_eq!(piece.sala, s.sala);
    assert_eq!(piece.artisan, s.artisan);
    assert_eq!(piece.passport_hash, hash(&s.env, 7));
    assert_eq!(piece.artisan_bps, 8_500);
    assert_eq!(piece.total_supported, 0);
    assert_eq!(s.client.get_piece(&symbol_short!("nada")), None);

    let ttl = s.env.as_contract(&s.contract_id, || {
        s.env
            .storage()
            .persistent()
            .get_ttl(&crate::DataKey::Piece(piece_id.clone()))
    });
    assert!(ttl >= 30 * 17_280);
}

#[test]
fn register_validates_bps_and_protects_existing_piece() {
    let s = setup();
    let piece_id = symbol_short!("pieza_02");
    assert_eq!(
        s.client.try_register_piece(
            &s.sala,
            &piece_id,
            &s.artisan,
            &hash(&s.env, 1),
            &(MAX_BPS + 1)
        ),
        Err(Ok(Error::InvalidBps))
    );

    register(&s, &piece_id, 10_000);
    let otra_sala = Address::generate(&s.env);
    assert_eq!(
        s.client
            .try_register_piece(&otra_sala, &piece_id, &s.artisan, &hash(&s.env, 2), &100),
        Err(Ok(Error::PieceAlreadyRegistered))
    );

    // La misma Sala sí puede actualizar su propia pieza.
    s.client
        .register_piece(&s.sala, &piece_id, &s.artisan, &hash(&s.env, 3), &9_000);
    let piece = s.client.get_piece(&piece_id).unwrap();
    assert_eq!(piece.passport_hash, hash(&s.env, 3));
    assert_eq!(piece.artisan_bps, 9_000);
}

#[test]
fn calls_without_require_auth_are_rejected() {
    let s = setup();
    let piece_id = symbol_short!("pieza_03");
    register(&s, &piece_id, 8_500);

    // Sin mocks de auth: nadie firmó nada.
    s.env.set_auths(&[]);
    assert!(s
        .client
        .try_register_piece(&s.sala, &symbol_short!("x"), &s.artisan, &hash(&s.env, 1), &1)
        .is_err());
    assert!(s
        .client
        .try_support_piece(&s.supporter, &piece_id, &USDC, &true)
        .is_err());
    assert!(s.client.try_claim(&s.artisan).is_err());

    // Un tercero que no es admin no puede cambiar el token.
    let intruso = Address::generate(&s.env);
    let otro_token = Address::generate(&s.env);
    s.env.mock_auths(&[MockAuth {
        address: &intruso,
        invoke: &MockAuthInvoke {
            contract: &s.contract_id,
            fn_name: "set_token",
            args: (&otro_token,).into_val(&s.env),
            sub_invokes: &[],
        },
    }]);
    assert!(s.client.try_set_token(&otro_token).is_err());

    // El admin sí puede.
    s.env.mock_auths(&[MockAuth {
        address: &s.admin,
        invoke: &MockAuthInvoke {
            contract: &s.contract_id,
            fn_name: "set_token",
            args: (&otro_token,).into_val(&s.env),
            sub_invokes: &[],
        },
    }]);
    s.client.set_token(&otro_token);
    assert_eq!(s.client.get_config().token, otro_token);
}

#[test]
fn split_is_exact_without_losing_stroops() {
    for &(amount, bps) in &[
        (1i128, 8_500u32),
        (7, 8_500),
        (9_999_999, 3_333),
        (10 * USDC + 3, 8_500),
        (123_456_789, 1),
        (55, 0),
        (55, 10_000),
    ] {
        let (a, sala) = split_amount(amount, bps).unwrap();
        assert_eq!(a + sala, amount);
        assert_eq!(a, amount * bps as i128 / 10_000);
    }
    assert_eq!(split_amount(i128::MAX, 10_000), Err(Error::Overflow));

    // Reparto real en cadena (pago directo, sin custodia).
    let s = setup();
    let piece_id = symbol_short!("pieza_04");
    register(&s, &piece_id, 8_500);
    let amount = 10 * USDC + 3;
    let (artisan_amount, sala_amount) =
        s.client
            .support_piece(&s.supporter, &piece_id, &amount, &false);
    assert_eq!(artisan_amount, 85_000_002);
    assert_eq!(sala_amount, 15_000_001);
    assert_eq!(s.token.balance(&s.artisan), artisan_amount);
    assert_eq!(s.token.balance(&s.sala), sala_amount);
    assert_eq!(s.token.balance(&s.contract_id), 0);
    assert_eq!(s.token.balance(&s.supporter), 1_000 * USDC - amount);
    assert_eq!(s.client.get_piece(&piece_id).unwrap().total_supported, amount);
}

#[test]
fn escrow_in_contract_then_claim() {
    let s = setup();
    let piece_id = symbol_short!("pieza_05");
    register(&s, &piece_id, 8_500);

    let (artisan_amount, sala_amount) =
        s.client
            .support_piece(&s.supporter, &piece_id, &(2 * USDC), &true);
    let expected = PieceSupported {
        piece_id: piece_id.clone(),
        supporter: s.supporter.clone(),
        sala: s.sala.clone(),
        artisan: s.artisan.clone(),
        token: s.token.address.clone(),
        amount: 2 * USDC,
        artisan_amount,
        sala_amount,
        hold_in_escrow: true,
        passport_hash: hash(&s.env, 7),
    };
    assert!(s
        .env
        .events()
        .all()
        .events()
        .contains(&expected.to_xdr(&s.env, &s.contract_id)));
    assert_eq!(artisan_amount, 17_000_000);
    assert_eq!(sala_amount, 3_000_000);
    assert_eq!(s.token.balance(&s.contract_id), artisan_amount);
    assert_eq!(s.token.balance(&s.sala), sala_amount);
    assert_eq!(s.token.balance(&s.artisan), 0);
    assert_eq!(s.client.get_pending_balance(&s.artisan), artisan_amount);

    advance_ledgers(&s.env, RECENT_SUPPORT_LEDGERS + 1);
    s.client
        .support_piece(&s.supporter, &piece_id, &USDC, &true);
    let total_pending = artisan_amount + 8_500_000;
    assert_eq!(s.client.get_pending_balance(&s.artisan), total_pending);
    assert_eq!(s.client.get_config().total_pending, total_pending);

    // No se puede cambiar el token con fondos custodiados.
    assert_eq!(
        s.client.try_set_token(&Address::generate(&s.env)),
        Err(Ok(Error::PendingEscrowNotEmpty))
    );

    assert_eq!(s.client.claim(&s.artisan), total_pending);
    assert_eq!(s.env.auths()[0].0, s.artisan);
    assert_eq!(s.token.balance(&s.artisan), total_pending);
    assert_eq!(s.token.balance(&s.contract_id), 0);
    assert_eq!(s.client.get_pending_balance(&s.artisan), 0);
    assert_eq!(s.client.get_config().total_pending, 0);
    assert_eq!(s.client.try_claim(&s.artisan), Err(Ok(Error::NothingToClaim)));
}

#[test]
fn rejects_double_click_and_invalid_amounts() {
    let s = setup();
    let piece_id = symbol_short!("pieza_06");
    register(&s, &piece_id, 8_500);

    assert_eq!(
        s.client.try_support_piece(&s.supporter, &piece_id, &0, &true),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        s.client.try_support_piece(&s.supporter, &piece_id, &-5, &true),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        s.client
            .try_support_piece(&s.supporter, &symbol_short!("no_existe"), &USDC, &true),
        Err(Ok(Error::PieceNotFound))
    );

    s.client.support_piece(&s.supporter, &piece_id, &USDC, &true);
    assert_eq!(
        s.client.try_support_piece(&s.supporter, &piece_id, &USDC, &true),
        Err(Ok(Error::DuplicateSupport))
    );
    advance_ledgers(&s.env, RECENT_SUPPORT_LEDGERS);
    assert_eq!(
        s.client.try_support_piece(&s.supporter, &piece_id, &USDC, &true),
        Err(Ok(Error::DuplicateSupport))
    );

    // Otro apoyador no queda bloqueado por el primero.
    let otro = Address::generate(&s.env);
    StellarAssetClient::new(&s.env, &s.token.address).mint(&otro, &USDC);
    s.client.support_piece(&otro, &piece_id, &USDC, &true);

    advance_ledgers(&s.env, 1);
    s.client.support_piece(&s.supporter, &piece_id, &USDC, &true);
    assert_eq!(s.client.get_piece(&piece_id).unwrap().total_supported, 3 * USDC);
}
