"""Fit a Random Forest occupancy classifier on the UCI Occupancy Detection
dataset — an off-the-shelf, near-instant-to-train classical ML model rather
than a sequence network, in line with the project's "fast, reliable,
well-established estimators over long training loops" decision (see
ROADMAP.md / CHANGELOG.md).

Run via: python manage.py train_occupancy
"""
from __future__ import annotations

import json
import time

import joblib
import numpy as np
from django.conf import settings
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score

from .dataset import FEATURE_COLUMNS, TARGET_COLUMN, load_splits

ARTIFACT_DIR = settings.ML_ARTIFACTS_DIR / 'occupancy'


def _metrics(y_true, y_pred, y_proba):
    return {
        'accuracy': float(accuracy_score(y_true, y_pred)),
        'precision': float(precision_score(y_true, y_pred)),
        'recall': float(recall_score(y_true, y_pred)),
        'f1': float(f1_score(y_true, y_pred)),
        'roc_auc': float(roc_auc_score(y_true, y_proba)),
    }


def train_all():
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    t0 = time.time()

    train_df, test_df = load_splits()
    x_train, y_train = train_df[FEATURE_COLUMNS].values, train_df[TARGET_COLUMN].values
    x_test, y_test = test_df[FEATURE_COLUMNS].values, test_df[TARGET_COLUMN].values

    rf = RandomForestClassifier(n_estimators=200, max_depth=10, n_jobs=-1, random_state=42, class_weight='balanced')
    rf.fit(x_train, y_train)
    rf_pred = rf.predict(x_test)
    rf_proba = rf.predict_proba(x_test)[:, 1]
    rf_metrics = _metrics(y_test, rf_pred, rf_proba)
    joblib.dump(rf, ARTIFACT_DIR / 'random_forest.joblib')

    # Second ensemble member: a linear baseline (logistic regression) —
    # cheap to fit, and its disagreement with the RF flags borderline cases.
    lr = LogisticRegression(max_iter=1000, class_weight='balanced')
    lr.fit(x_train, y_train)
    lr_pred = lr.predict(x_test)
    lr_proba = lr.predict_proba(x_test)[:, 1]
    lr_metrics = _metrics(y_test, lr_pred, lr_proba)
    joblib.dump(lr, ARTIFACT_DIR / 'logistic_regression.joblib')

    importances = dict(zip(FEATURE_COLUMNS, rf.feature_importances_.round(4).tolist()))

    meta = {
        'feature_columns': FEATURE_COLUMNS,
        'target_column': TARGET_COLUMN,
        'dataset': 'UCI Occupancy Detection Dataset',
        'n_train': int(len(train_df)),
        'n_test': int(len(test_df)),
        'models': ['random_forest', 'logistic_regression'],
        'feature_importances_random_forest': importances,
        'trained_at': time.time(),
        'train_seconds': time.time() - t0,
        'results': {
            'random_forest': rf_metrics,
            'logistic_regression': lr_metrics,
        },
    }
    with open(ARTIFACT_DIR / 'meta.json', 'w') as f:
        json.dump(meta, f, indent=2)

    print(f"[random_forest] acc={rf_metrics['accuracy']:.3f} f1={rf_metrics['f1']:.3f} auc={rf_metrics['roc_auc']:.3f}")
    print(f"[logistic_regression] acc={lr_metrics['accuracy']:.3f} f1={lr_metrics['f1']:.3f} auc={lr_metrics['roc_auc']:.3f}")
    print(f'Done in {time.time() - t0:.1f}s. Artifacts written to {ARTIFACT_DIR}')
    return meta
