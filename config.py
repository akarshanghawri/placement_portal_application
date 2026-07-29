import os
from dotenv import load_dotenv
from celery.schedules import crontab

load_dotenv(override=False)

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
    CLERK_FRONTEND_API = os.environ.get('CLERK_FRONTEND_API')
    CLERK_SECRET_KEY = os.environ.get('CLERK_SECRET_KEY')

    DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///placement.db')
    if DATABASE_URL and DATABASE_URL.startswith('postgres://'):
        DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
    SQLALCHEMY_DATABASE_URI = DATABASE_URL

    CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0')
    CELERY_RESULT_BACKEND =  os.environ.get('CELERY_RESULT_BACKEND', 'redis://localhost:6379/1')
    CELERY_TIMEZONE = 'Asia/Kolkata'
    CELERY_ENABLE_UTC = False
    
    CACHE_TYPE = 'RedisCache'
    CACHE_REDIS_URL = os.environ.get('CACHE_REDIS_URL', 'redis://localhost:6379/2')
    CACHE_OPTIONS = {
        'ssl_cert_reqs': None
    }

    MAIL_SERVER = 'smtp.gmail.com'
    MAIL_PORT = 587
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')         # Gmail app password setup from google account
    ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL')

    UPLOAD_FOLDER = 'uploads'
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024

    CELERYBEAT_SCHEDULE = {
        'daily-reminders': {
            'task': 'app.jobs.tasks.send_daily_reminders',
            'schedule': crontab(hour=10, minute=0),
        },
        'monthly-report': {
            'task': 'app.jobs.tasks.send_monthly_report',
            'schedule': crontab(day_of_month=1, hour=0, minute=0),
        },
    }