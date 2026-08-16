from django.core.management.base import BaseCommand

from energy_manager.ml.train import train_all


class Command(BaseCommand):
    help = 'Train the tabular Q-learning home-energy-management agent.'

    def handle(self, *args, **options):
        train_all()
