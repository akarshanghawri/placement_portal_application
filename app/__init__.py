from flask import Flask, jsonify, render_template
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from celery import Celery
from flask_mail import Mail
from flask_caching import Cache

db = SQLAlchemy()
jwt = JWTManager()
celery = Celery()
mail = Mail()
cache = Cache()

import os
os.environ['TZ'] = 'Asia/Kolkata'

def create_app():
    app = Flask(__name__,static_folder='../static')
    app.config.from_object('config.Config')

    db.init_app(app)
    jwt.init_app(app)
    mail.init_app(app)

    cache.init_app(app, config={
        'CACHE_TYPE': 'RedisCache',
        'CACHE_REDIS_URL': app.config['CACHE_REDIS_URL'], 
        'CACHE_DEFAULT_TIMEOUT': 300,
        'CACHE_OPTIONS': {
            'ssl_cert_reqs': None,
            'socket_connect_timeout': 5,
            'socket_timeout': 5,
        }
    })

    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,       
        'pool_recycle': 300,         # recycle connections every 5 minutes
        'pool_size': 5,
        'max_overflow': 2,
    }

    celery.conf.update(
        broker_url=app.config['CELERY_BROKER_URL'],
        result_backend=app.config['CELERY_RESULT_BACKEND']
    )

    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)
    celery.Task = ContextTask

    from .auth.routes import auth_bp
    from .admin.routes import admin_bp
    from .company.routes import company_bp
    from .student.routes import student_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(company_bp, url_prefix='/api/company')
    app.register_blueprint(student_bp, url_prefix='/api/student')

    with app.app_context():
        db.create_all()
        seed_admin()   # creates admin if not exists

    # print("SQLALCHEMY_DATABASE_URI =", app.config["SQLALCHEMY_DATABASE_URI"])
    
    @app.route('/')
    def index():
        return render_template('index.html',
            clerk_publishable_key=os.environ.get('CLERK_PUBLISHABLE_KEY'),
            clerk_frontend_api=os.environ.get('CLERK_FRONTEND_API')
        )

    return app

def seed_admin():
    from .models import User
    from werkzeug.security import generate_password_hash
    import os

    admin = User.query.filter_by(role='admin').first()
    if not admin:
        admin = User(
            clerk_id='admin',   # placeholder bcz admin doesn't use Clerk
            username='admin',
            email=os.environ.get('ADMIN_EMAIL'),
            password=generate_password_hash('admin123'),
            role='admin'
        )
        db.session.add(admin)
        db.session.commit()



