from flask import Flask, render_template
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
        'CACHE_REDIS_URL': 'redis://localhost:6379/2',
        'CACHE_DEFAULT_TIMEOUT': 300   # 300 seconds 
    })

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
    
    @app.route('/')
    def index():
        return render_template('index.html')

    return app


def seed_admin():
    from .models import User
    from werkzeug.security import generate_password_hash
    
    admin = User.query.filter_by(role='admin').first()
    if not admin:
        admin = User(
            username='admin',
            email='24f2004832@ds.study.iitm.ac.in',
            password=generate_password_hash('admin123'),
            role='admin'
        )
        db.session.add(admin)
        db.session.commit()

