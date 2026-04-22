from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

from main import app
from core.security import create_access_token, pwd_context

from datetime import datetime, timedelta, timezone
import hashlib


client = TestClient(app)


def _mock_begin_with_row(row, method="first"):
    mock_engine = MagicMock()
    mock_conn = MagicMock()

    mock_engine.begin.return_value.__enter__.return_value = mock_conn
    mock_engine.begin.return_value.__exit__.return_value = None

    mappings_mock = mock_conn.execute.return_value.mappings.return_value
    getattr(mappings_mock, method).return_value = row

    return mock_engine


class _FakeMappings:
    def __init__(self, *, first=None, one=None, all=None):
        self._first = first
        self._one = one
        self._all = all if all is not None else []

    def first(self):
        return self._first

    def one(self):
        return self._one

    def all(self):
        return self._all


class _FakeResult:
    def __init__(self, *, first=None, one=None, all=None):
        self._mappings = _FakeMappings(first=first, one=one, all=all)

    def mappings(self):
        return self._mappings


# ==== TESTS FOR POST ENDPOINTS ====

@patch("main.engine")
def test_create_user(mock_engine):
    fake_row = {
        "id": 101,
        "first_name": "Test",
        "last_name": "User",
        "email": "testuser@example.com",
        "username": "testuser",
        "created_at": "2024-01-01T00:00:00Z",
    }

    fake_engine = _mock_begin_with_row(fake_row, method="one")
    mock_engine.begin = fake_engine.begin

    response = client.post(
        "/users",
        json={
            "first_name": "Test",
            "last_name": "User",
            "email": "testuser@example.com",
            "username": "testuser",
            "password": "testpassword",
        },
    )

    assert response.status_code == 201

    data = response.json()
    assert data["id"] == 101
    assert data["first_name"] == "Test"
    assert data["last_name"] == "User"
    assert data["email"] == "testuser@example.com"
    assert data["username"] == "testuser"
    assert "created_at" in data


@patch("main.engine")
def test_create_profile(mock_engine):
    fake_row = {
        "id": 201,
        "user_id": 1,
        "display_name": "Test User",
        "bio": "This is a test bio.",
        "location": "Test Location",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
    }

    fake_engine = _mock_begin_with_row(fake_row, method="one")
    mock_engine.begin = fake_engine.begin

    token = create_access_token(
        {"sub": "1", "email": "testuser@example.com", "username": "testuser"}
    )

    response = client.post(
        "/profiles",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "display_name": "Test User",
            "bio": "This is a test bio.",
            "location": "Test Location",
        },
    )

    assert response.status_code == 201

    data = response.json()
    assert data["id"] == 201
    assert data["user_id"] == 1
    assert data["display_name"] == "Test User"
    assert data["bio"] == "This is a test bio."
    assert data["location"] == "Test Location"
    assert "created_at" in data
    assert "updated_at" in data

@patch("main.engine")
def test_login(mock_engine):
    from core.security import pwd_context

    fake_row = {
        "id": 1,
        "first_name": "Test",
        "last_name": "User",
        "email": "testuser@example.com",
        "username": "testuser",
        "password_hash": pwd_context.hash("testpassword"),
        "email_verified": True,
    }

    fake_engine = _mock_begin_with_row(fake_row, method="first")
    mock_engine.begin = fake_engine.begin

    response = client.post(
        "/login",
        json={
            "login": "testuser",
            "password": "testpassword",
        },
    )

    assert response.status_code == 200

    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["id"] == 1
    assert data["user"]["email"] == "testuser@example.com"
    assert data["user"]["username"] == "testuser"


@patch("main.engine")
def test_login_invalid_password(mock_engine):
    from core.security import pwd_context

    fake_row = {
        "id": 1,
        "first_name": "Test",
        "last_name": "User",
        "email": "testuser@example.com",
        "username": "testuser",
        "password_hash": pwd_context.hash("correctpassword"),
        "email_verified": True,
    }

    fake_engine = _mock_begin_with_row(fake_row, method="first")
    mock_engine.begin = fake_engine.begin

    response = client.post(
        "/login",
        json={
            "login": "testuser",
            "password": "wrongpassword",
        },
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid credentials"}

@patch("main.engine")
def test_login_user_not_found(mock_engine):
    fake_engine = _mock_begin_with_row(None, method="first")
    mock_engine.begin = fake_engine.begin

    response = client.post(
        "/login",
        json={
            "login": "missinguser",
            "password": "testpassword",
        },
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid credentials"}


@patch("main.engine")
def test_login_email_not_verified(mock_engine):
    from core.security import pwd_context

    fake_row = {
        "id": 1,
        "first_name": "Test",
        "last_name": "User",
        "email": "testuser@example.com",
        "username": "testuser",
        "password_hash": pwd_context.hash("testpassword"),
        "email_verified": False,
    }

    fake_engine = _mock_begin_with_row(fake_row, method="first")
    mock_engine.begin = fake_engine.begin

    response = client.post(
        "/login",
        json={
            "login": "testuser",
            "password": "testpassword",
        },
    )

    assert response.status_code == 403
    assert response.json() == {
        "detail": "Please verify your email before signing in",
    }

# Test verification endpoint sends correctly for found user
@patch("main.engine")
def test_resending_endpoint(mock_engine):
    from core.security import pwd_context

    fake_row = {
        "id": 1,
        "first_name": "Test",
        "last_name": "User",
        "email": "testuser@example.com",
        "username": "testuser",
        "password_hash": pwd_context.hash("testpassword"),
        "email_verified": False,
    }

    fake_engine = _mock_begin_with_row(fake_row, method="first")
    mock_engine.begin = fake_engine.begin

    response = client.post(
        "/resendVerification",
        json = {
            "login": "testuser",
            "password": "testpassword"
        }
    )

    assert response.status_code == 200

# ==== TESTS FOR GET ENDPOINTS ====

@patch("main.engine")
def test_get_user(mock_engine):
    fake_row = {
        "id": 1,
        "first_name": "Test",
        "last_name": "User",
        "email": "testuser@example.com",
        "username": "testuser",
        "created_at": "2024-01-01T00:00:00Z",
    }

    fake_engine = _mock_begin_with_row(fake_row, method="first")
    mock_engine.begin = fake_engine.begin

    response = client.get("/users/1")
    assert response.status_code == 200

    data = response.json()
    assert data["id"] == 1
    assert data["first_name"] == "Test"
    assert data["last_name"] == "User"
    assert data["email"] == "testuser@example.com"
    assert data["username"] == "testuser"
    assert "created_at" in data


@patch("main.engine")
def test_get_user_not_found(mock_engine):
    fake_engine = _mock_begin_with_row(None, method="first")
    mock_engine.begin = fake_engine.begin

    response = client.get("/users/999999")
    assert response.status_code == 404
    assert response.json() == {"detail": "User not found"}


@patch("main.engine")
def test_get_profile(mock_engine):
    fake_row = {
        "id": 1,
        "user_id": 1,
        "display_name": "Test User",
        "bio": "Hello",
        "location": "NJ",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
    }

    fake_engine = _mock_begin_with_row(fake_row, method="first")
    mock_engine.begin = fake_engine.begin

    response = client.get("/profiles/1")
    assert response.status_code == 200

    data = response.json()
    assert data["id"] == 1
    assert data["user_id"] == 1
    assert data["display_name"] == "Test User"
    assert data["bio"] == "Hello"
    assert data["location"] == "NJ"
    assert "created_at" in data
    assert "updated_at" in data


@patch("main.engine")
def test_get_profile_not_found(mock_engine):
    fake_engine = _mock_begin_with_row(None, method="first")
    mock_engine.begin = fake_engine.begin

    response = client.get("/profiles/999999")
    assert response.status_code == 404
    assert response.json() == {"detail": "Profile not found"}


@patch("main.engine")
def test_get_user_profile(mock_engine):
    fake_row = {
        "id": 10,
        "user_id": 1,
        "display_name": "Test User",
        "bio": "Hello",
        "location": "NJ",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
    }

    fake_engine = _mock_begin_with_row(fake_row, method="first")
    mock_engine.begin = fake_engine.begin

    response = client.get("/users/1/profile")
    assert response.status_code == 200

    data = response.json()
    assert data["id"] == 10
    assert data["user_id"] == 1
    assert data["display_name"] == "Test User"
    assert data["bio"] == "Hello"
    assert data["location"] == "NJ"
    assert "created_at" in data
    assert "updated_at" in data


@patch("main.engine")
def test_get_user_profile_not_found(mock_engine):
    fake_engine = _mock_begin_with_row(None, method="first")
    mock_engine.begin = fake_engine.begin

    response = client.get("/users/999999/profile")
    assert response.status_code == 404
    assert response.json() == {"detail": "Profile not found"}

@patch("main.engine")
def test_verification_returns_good(mock_engine):

    fake_row = {
        "id": 10,
        "user_id": 1,
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=24),
        "used_at": None,
        "token_hash": hashlib.sha256("12345678".encode()).hexdigest()
    }

    fake_engine = _mock_begin_with_row(fake_row, method="first")
    mock_engine.begin = fake_engine.begin

    response = client.get("/verify?token=12345678")
    assert response.status_code == 200

@patch("main.engine")
def test_verification_token_not_found(mock_engine):

    fake_engine = _mock_begin_with_row(None, method="first")
    mock_engine.begin = fake_engine.begin

    response = client.get("/verify?token=12345678")
    assert response.status_code == 400

@patch("main.engine")
def test_verification_token_already_used(mock_engine):

    fake_row = {
        "id": 10,
        "user_id": 1,
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=24),
        "used_at": datetime.now(timezone.utc),
        "token_hash": hashlib.sha256("12345678".encode()).hexdigest()
    }

    fake_engine = _mock_begin_with_row(fake_row, method="first")
    mock_engine.begin = fake_engine.begin

    response = client.get("/verify?token=12345678")
    assert response.status_code == 410

@patch("main.engine")
def test_verification_token_expired(mock_engine):

    fake_row = {
        "id": 10,
        "user_id": 1,
        "expires_at": datetime.now(timezone.utc) - timedelta(hours=24),
        "used_at": None,
        "token_hash": hashlib.sha256("12345678".encode()).hexdigest()
    }

    fake_engine = _mock_begin_with_row(fake_row, method="first")
    mock_engine.begin = fake_engine.begin

    response = client.get("/verify?token=12345678")
    assert response.status_code == 401


@patch("main.engine")
def test_accept_individual_no_auto_ready(mock_engine):
    """Individual accept should insert participant with ready=false (fill-then-timer model)."""
    token = create_access_token({"sub": "7", "email": "a@b.com", "username": "u"})
    future = datetime.now(timezone.utc) + timedelta(hours=1)

    mock_conn = MagicMock()
    mock_engine.begin.return_value.__enter__.return_value = mock_conn
    mock_engine.begin.return_value.__exit__.return_value = None

    # Call sequence for /posts/{id}/accept-individual (fill-then-timer):
    # 1) select post
    # 2) side counts
    # 3) insert participant
    # 4) fill-check side counts
    mock_conn.execute.side_effect = [
        _FakeResult(first={
            "id": 123, "user_id": 55, "team_id": None, "sport_id": 1,
            "status": "open", "players_per_side": 2,
            "locked_by_user_id": None, "locked_at": None,
            "ready_deadline_at": None, "expires_at": future
        }),
        _FakeResult(all=[]),
        _FakeResult(first={
            "id": 1, "match_post_id": 123, "user_id": 7, "side": "A",
            "team_id": None, "selected_for_match": True, "ready": False,
            "joined_at": datetime.now(timezone.utc),
        }),
        _FakeResult(all=[{"side": "A", "c": 1}]),
    ]

    res = client.post("/posts/123/accept-individual", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["user_id"] == 7
    assert data["ready"] is False


@patch("main.engine")
def test_team_join_happy_path(mock_engine):
    """Team member can join a team post while status is open."""
    token = create_access_token({"sub": "1", "email": "a@b.com", "username": "u"})
    future = datetime.now(timezone.utc) + timedelta(hours=1)

    mock_conn = MagicMock()
    mock_engine.begin.return_value.__enter__.return_value = mock_conn
    mock_engine.begin.return_value.__exit__.return_value = None

    # Call sequence for /posts/{id}/join (team, poster side):
    # 1) select post
    # 2) get_users_team_for_sport (if no team_id in payload)
    # 3) team membership check
    # 4) side count
    # 5) insert participant
    # 6) re-read post
    # 7) fill-check side counts
    mock_conn.execute.side_effect = [
        _FakeResult(first={
            "id": 50, "team_id": 10, "sport_id": 1, "status": "open",
            "players_per_side": 3, "locked_by_team_id": None,
            "ready_deadline_at": None, "expires_at": future
        }),
        _FakeResult(first={"team_id": 10}),
        _FakeResult(first=(1,)),
        _FakeResult(one={"c": 0}),
        _FakeResult(one={
            "id": 1, "match_post_id": 50, "user_id": 1, "side": "poster",
            "team_id": 10, "selected_for_match": True, "ready": False,
            "joined_at": datetime.now(timezone.utc),
        }),
        _FakeResult(one={"id": 50, "team_id": 10, "players_per_side": 3, "status": "open", "locked_by_team_id": None}),
        _FakeResult(all=[{"side": "poster", "c": 1}]),
    ]

    res = client.post("/posts/50/join", headers={"Authorization": f"Bearer {token}"}, json={})
    assert res.status_code == 200
    data = res.json()
    assert data["side"] == "poster"
    assert data["ready"] is False


@patch("main.engine")
def test_ready_rejected_before_ready_window(mock_engine):
    """Ready should fail when status is still 'open' (ready window not started)."""
    token = create_access_token({"sub": "1", "email": "a@b.com", "username": "u"})
    future = datetime.now(timezone.utc) + timedelta(hours=1)

    mock_conn = MagicMock()
    mock_engine.begin.return_value.__enter__.return_value = mock_conn
    mock_engine.begin.return_value.__exit__.return_value = None

    mock_conn.execute.side_effect = [
        _FakeResult(first={
            "id": 50, "team_id": 10, "status": "open",
            "players_per_side": 5, "ready_deadline_at": None,
            "expires_at": future
        }),
    ]

    res = client.post("/posts/50/ready", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 409
    assert "not started" in res.json()["detail"].lower()

