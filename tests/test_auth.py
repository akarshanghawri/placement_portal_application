import pytest
import json
from app import create_app, db
import os
from dotenv import load_dotenv

load_dotenv()

@pytest.fixture
def app():
    os.environ['DATABASE_URL'] = 'sqlite:///:memory:'

    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'  # in-memory DB, no file created
    app.config['JWT_SECRET_KEY'] = 'test-secret'
    app.config['CACHE_TYPE'] = 'SimpleCache'  
    
    with app.app_context():
        db.create_all()
        from app import seed_admin
        seed_admin()

    yield app

    with app.app_context():
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def admin_token(client):
    res = client.post('/api/auth/login', json={
        'email': os.environ.get('ADMIN_EMAIL'),
        'password': 'admin123'
    })
    return json.loads(res.data)['token']


# ─── Auth Tests ───

def test_admin_login_success(client):
    res = client.post('/api/auth/login', json={
        'email': os.environ.get('ADMIN_EMAIL'),
        'password': 'admin123'
    })
    data = json.loads(res.data)
    assert res.status_code == 200
    assert 'token' in data
    assert data['role'] == 'admin'


def test_login_wrong_password(client):
    res = client.post('/api/auth/login', json={
        'email': 'admin@portal.com',
        'password': 'wrongpassword'
    })
    assert res.status_code == 401


def test_login_wrong_email(client):
    res = client.post('/api/auth/login', json={
        'email': 'notexist@portal.com',
        'password': 'admin123'
    })
    assert res.status_code == 401


def test_register_student_success(client):
    res = client.post('/api/auth/register/student', json={
        'username': 'teststudent',
        'email': 'student@test.com',
        'password': 'test123',
        'full_name': 'Test Student',
        'branch': 'CSE',
        'cgpa': 8.5,
        'year': 3,
        'phone': '9999999999'
    })
    assert res.status_code == 201


def test_register_duplicate_student(client):
    # Register once
    client.post('/api/auth/register/student', json={
        'username': 'teststudent',
        'email': 'student@test.com',
        'password': 'test123',
        'full_name': 'Test Student',
        'branch': 'CSE',
        'cgpa': 8.5,
        'year': 3,
        'phone': '9999999999'
    })
    # Register again with same email
    res = client.post('/api/auth/register/student', json={
        'username': 'teststudent2',
        'email': 'student@test.com',
        'password': 'test123',
        'full_name': 'Test Student 2',
        'branch': 'CSE',
        'cgpa': 8.5,
        'year': 3,
        'phone': '9999999999'
    })
    assert res.status_code == 400


def test_register_company_success(client):
    res = client.post('/api/auth/register/company', json={
        'username': 'testcompany',
        'email': 'company@test.com',
        'password': 'test123',
        'company_name': 'Test Corp',
        'hr_contact': 'HR Person',
        'website': 'https://testcorp.com',
        'description': 'A test company'
    })
    assert res.status_code == 201


# ─── Admin Tests ───

def test_admin_stats_authenticated(client, admin_token):
    res = client.get('/api/admin/stats', headers={
        'Authorization': f'Bearer {admin_token}'
    })
    assert res.status_code == 200
    data = json.loads(res.data)
    assert 'total_students' in data
    assert 'total_companies' in data
    assert 'total_drives' in data


def test_admin_stats_unauthenticated(client):
    res = client.get('/api/admin/stats')
    assert res.status_code == 401


def test_student_cannot_access_admin(client):
    # Register and login as student
    client.post('/api/auth/register/student', json={
        'username': 'teststudent',
        'email': 'student@test.com',
        'password': 'test123',
        'full_name': 'Test Student',
        'branch': 'CSE',
        'cgpa': 8.5,
        'year': 3,
        'phone': '9999999999'
    })
    login_res = client.post('/api/auth/login', json={
        'email': 'student@test.com',
        'password': 'test123'
    })
    token = json.loads(login_res.data)['token']

    # Try to access admin route
    res = client.get('/api/admin/stats', headers={
        'Authorization': f'Bearer {token}'
    })
    assert res.status_code == 403