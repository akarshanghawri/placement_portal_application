import os
from dotenv import load_dotenv
from celery.schedules import crontab

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY')
    SQLALCHEMY_DATABASE_URI = 'sqlite:///placement.db'

    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
    CELERY_BROKER_URL = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND = "redis://localhost:6379/1"
    CELERY_TIMEZONE = 'Asia/Kolkata'
    CELERY_ENABLE_UTC = False
    
    CACHE_TYPE = 'RedisCache'
    CACHE_REDIS_URL = "redis://localhost:6379/2"

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