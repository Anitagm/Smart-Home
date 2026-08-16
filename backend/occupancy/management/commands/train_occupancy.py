from django.core.management.base import BaseCommand

from occupancy.ml.train import train_all


class Command(BaseCommand):
    help = 'Train the Random Forest / Logistic Regression occupancy classifiers on the UCI Occupancy Detection dataset.'

    def handle(self, *args, **options):
        train_all()
