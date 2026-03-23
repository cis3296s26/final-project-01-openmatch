from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from main import pwd_context, app


client = TestClient(app)


def _mock_begin_with_row(row, method="first"):
    mock_engine = MagicMock()
    mock_conn = MagicMock()

    mock_engine.begin.return_value.__enter__.return_value = mock_conn
    mock_engine.begin.return_value.__exit__.return_value = None

    mappings_mock = mock_conn.execute.return_value.mappings.return_value
    getattr(mappings_mock, method).return_value = row

    return mock_engine


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

    response = client.post(
        "/profiles",
        json={
            "user_id": 1,
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
    from main import pwd_context

    fake_row = {
        "id": 1,
        "email": "testuser@example.com",
        "username": "testuser",
        "password_hash": pwd_context.hash("testpassword"),
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
    assert data["id"] == 1
    assert data["email"] == "testuser@example.com"
    assert data["username"] == "testuser"


@patch("main.engine")
def test_login_invalid_password(mock_engine):
    from main import pwd_context

    fake_row = {
        "id": 1,
        "email": "testuser@example.com",
        "username": "testuser",
        "password_hash": pwd_context.hash("correctpassword"),
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

    assert response.status_code == 200
    assert response.json() == {"error": "Invalid credentials"}

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

    assert response.status_code == 200
    assert response.json() == {"error": "Invalid credentials"}


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

