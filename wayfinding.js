import { spaces, floorById } from './map-data.js';

export const roomTypeFor = ({ category }) => {
  if (category === 'administration') return 'administration';
  if (category === 'gym') return 'gym';
  if (['classroom', 'workshop', 'technical'].includes(category)) return 'classroom';
  return 'neutral';
};

export const roomTypes = {
  classroom: 'Sala lekcyjna / pracownia',
  administration: 'Administracja',
  gym: 'Sala gimnastyczna',
  neutral: 'Pozostałe pomieszczenie',
};

// Only links supported by the existing room descriptions are asserted here.
// Ambiguous rooms deliberately have no preferred staircase.
const stairSideByRoom = {
  psycholog: 'left', '4': 'left', '5': 'left', '18': 'left', '29': 'left', '39': 'left',
  '05': 'left', 'sala-kinowa': 'left',
  'gim-piwnica': 'center', '2': 'center', 'wc-0': 'center',
  '16': 'center', '27': 'center', '38': 'center',
  '1': 'right', portiernia: 'right', '23': 'right', '34': 'right', '44': 'right',
};

export const accessForRoom = (space) => {
  const floor = floorById(space.floorId);
  const campusLocationId = floor.buildingId === 'workshops'
    ? (['prf2', 'prf3', 'p7', 'p8'].includes(space.id) ? 'hairdressing' : 'gastronomy')
    : floor.buildingId;
  const side = stairSideByRoom[space.id];
  return {
    campusLocationId,
    stairId: side ? `${space.floorId}-stairs-${side}` : null,
    stairName: side ? { left: 'lewa', center: 'środkowa', right: 'prawa' }[side] : null,
    entranceId: campusLocationId === 'main' ? 'parter-main'
      : campusLocationId === 'gym' ? 'gym-entrance' : `${campusLocationId}-entrance`,
  };
};

export const findRoom = (value) => {
  const id = String(value || '').toLowerCase();
  return spaces.find((space) => space.id.toLowerCase() === id)
    || spaces.find((space) => space.aliases.some((alias) => alias.toLowerCase() === id));
};

export const readNavigation = (url, mobile = false) => {
  const params = url.searchParams;
  const room = findRoom(params.get('room'));
  const floor = floorById(room?.floorId) || floorById(params.get('floor')) || floorById('parter');
  return {
    view: params.get('view') === 'campus' ? 'campus' : 'indoor',
    buildingId: floor.buildingId,
    floorId: floor.id,
    activeRoomId: room?.id || null,
    mode: floor.buildingId === 'main' && params.get('mode') === '2.5d' ? '2.5d' : '2d',
    campusMode: params.get('context') === 'surroundings' ? 'surroundings' : 'scheme',
    campusLocationId: ['main', 'gym', 'gastronomy', 'hairdressing'].includes(params.get('location'))
      ? params.get('location') : room ? accessForRoom(room).campusLocationId : floor.buildingId === 'workshops' ? 'gastronomy' : floor.buildingId,
  };
};
