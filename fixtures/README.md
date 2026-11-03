# Fixtures

Muestra **real** recortada de la API de precios de carburantes del Ministerio para la Transición Ecológica y el Reto Demográfico (obtenida el 28/10/2026). Se usa solo en tests y en desarrollo.

- `estaciones-terrestres.sample.json`: 150 estaciones con el formato exacto de la API (decimales con coma, IDs como texto). Incluye casos límite: coordenadas a 0 o intercambiadas, rótulo y dirección muy largos, rótulos con espacios o sin rótulo, productos poco habituales, estaciones sin ninguno de los combustibles del MVP, horarios con varios tramos, Ceuta, Melilla, Canarias y Baleares.
- `productos-petroliferos.json`: catálogo de productos.

Fuente: Ministerio para la Transición Ecológica y el Reto Demográfico — Precio de carburantes en las gasolineras españolas. No sugiere respaldo oficial.
