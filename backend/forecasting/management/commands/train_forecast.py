from django.core.management.base import BaseCommand

from forecasting.ml.train import train_all


class Command(BaseCommand):
    help = 'Train the LSTM/GRU/CNN-LSTM energy-forecasting ensemble on the UCI household power dataset.'

    def add_arguments(self, parser):
        parser.add_argument('--force-reload-data', action='store_true',
                             help='Re-parse the raw UCI text file instead of using the cached hourly parquet.')

    def handle(self, *args, **options):
        train_all(force_reload_data=options['force_reload_data'])
