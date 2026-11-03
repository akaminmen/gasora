import type { StationCardProps } from '../../components/ui/Station';

/**
 * Textos extremos reales (Fase 0): el rótulo más largo mide 86 caracteres y la dirección más
 * larga 104, tal como los envía el Ministerio (con el doble espacio incluido).
 */
export const LONG_NAME =
  'ESTACION DE SERVICIO DIEGO PILETA  Y AUTOLAVADO AGUA OSMOTIZADA: HIJOS DE DIEGO PILETA';
export const LONG_ADDRESS =
  'CARRETERA 634 PK 77,310 KM  DONOSTIA/SAN SEBASTAIN A SANTANDER Y LA CORUÑA POL IND EITUA Nº71 KM. 77,310';

export interface CardSample extends StationCardProps {
  /** Descripción del caso, para la galería y los mensajes de los tests */
  caseName: string;
}

/** Casos de la sección 9.7 (regla 6): extremos, sin ahorro, sin badge, precio 1,999, ahorro de 3 cifras. */
/** Caso más duro: todo extremo a la vez. */
export const EXTREME_CARD: CardSample = {
  caseName: 'rótulo de 86 y dirección de 104, precio 1,999, ahorro de 3 cifras',
  id: 'm3',
  name: LONG_NAME,
  brandKey: 'otras',
  address: LONG_ADDRESS,
  distanceKm: 12.3,
  price: 1999,
  tier: 'top',
  best: true,
  saving: 123.45,
};

export const CARD_SAMPLES: CardSample[] = [
  {
    caseName: 'más barata y seleccionada',
    id: 'm1',
    name: 'Ballenoil',
    brandKey: 'ballenoil',
    address: 'Av. de Velázquez, 118',
    distanceKm: 0.9,
    price: 1359,
    tier: 'cheap',
    best: true,
    saving: 3.69,
    selected: true,
  },
  {
    caseName: 'normal con favorito',
    id: 'm2',
    name: 'Shell',
    brandKey: 'shell',
    address: 'Av. de Andalucía, 18',
    distanceKm: 0.6,
    price: 1419,
    tier: 'mid',
    saving: 0.69,
    favorite: true,
  },
  EXTREME_CARD,
  {
    caseName: 'sin ahorro y sin badge',
    id: 'm4',
    name: 'Repsol',
    brandKey: 'repsol',
    address: 'Av. de Valle-Inclán, 14',
    distanceKm: 0.4,
    price: 1529,
    tier: 'high',
  },
  {
    caseName: 'rótulo largo sin badge, con ahorro y distancia grande',
    id: 'm5',
    name: LONG_NAME,
    brandKey: 'otras',
    address: LONG_ADDRESS,
    distanceKm: 120.4,
    price: 1459,
    tier: 'mid',
    saving: 1.5,
    favorite: true,
  },
  {
    caseName: 'rótulo con número y sin distancia',
    id: 'm6',
    name: 'Nº 10.935',
    brandKey: 'otras',
    address: 'AVENIDA CASTILLA LA MANCHA, 26',
    price: 1699,
    tier: 'high',
    saving: 0.01,
  },
];
