from django.urls import path

from . import views

urlpatterns = [
    path('recommend/', views.recommend_view, name='energy-manager-recommend'),
    path('history/', views.history_view, name='energy-manager-history'),
    path('recommendations/<int:pk>/decide/', views.decide_view, name='energy-manager-decide'),
]
