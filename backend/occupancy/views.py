from rest_framework.decorators import api_view
from rest_framework.response import Response

from .ml.infer import OccupancyModelNotReady, predict_rooms


@api_view(['POST'])
def predict_view(request):
    """
    POST /api/occupancy/predict/
    { "rooms": [ { "name": "Living Room", "temp": "22°C", "rh": "45% RH",
                    "devices": [{"label": "Lights", "on": true}] }, ... ] }
    """
    rooms = (request.data or {}).get('rooms') or []
    if not rooms:
        return Response({'error': 'Provide a non-empty "rooms" list.'}, status=400)

    try:
        result = predict_rooms(rooms)
    except OccupancyModelNotReady as exc:
        return Response({'error': str(exc)}, status=503)

    return Response(result)
