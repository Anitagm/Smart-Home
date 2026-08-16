from rest_framework.decorators import api_view
from rest_framework.response import Response

from .ml.infer import ForecastNotReady, get_forecast


@api_view(['GET', 'POST'])
def forecast_view(request):
    """
    GET  /api/forecasting/forecast/?horizon=48
    POST /api/forecasting/forecast/  { "horizon": 48, "whatif_kwh": 1.5, "whatif_hours": [18, 19] }
    """
    if request.method == 'GET':
        horizon = request.GET.get('horizon')
        payload = {'horizon': int(horizon) if horizon else None}
    else:
        payload = request.data or {}

    try:
        result = get_forecast(
            horizon=payload.get('horizon'),
            whatif_kwh=float(payload.get('whatif_kwh') or 0),
            whatif_hours=payload.get('whatif_hours') or [],
        )
    except ForecastNotReady as exc:
        return Response({'error': str(exc)}, status=503)

    return Response(result)
