export function findWorker(workers, user) {
  const userId = user?.userId ?? user?.id;
  if (userId == null) return null;
  return workers.find(worker => String(worker.userId) === String(userId)) || null;
}
export function navigationUrl(lat, lng) {
  if (lat == null || lng == null || lat === '' || lng === '') return null;
  lat = Number(lat);
  lng = Number(lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const params = new URLSearchParams({
    api: '1',
    destination: `${lat},${lng}`,
    travelmode: 'driving',
    dir_action: 'navigate'
  });
  return `https://www.google.com/maps/dir/?${params}`;
}
export function distanceKm(lat1, lng1, lat2, lng2) {
  const rad = degrees => degrees * Math.PI / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
export function turnInstruction(step) {
  const maneuver = step.maneuver || {};
  const road = step.name ? ` onto ${step.name}` : '';
  if (maneuver.type === 'arrive') return 'Arrive at the customer’s location';
  if (maneuver.type === 'depart') return `Head ${maneuver.modifier || 'straight'}${road}`;
  if (maneuver.type === 'roundabout' || maneuver.type === 'rotary') return `Take exit ${maneuver.exit || ''} at the roundabout${road}`;
  if (maneuver.type === 'turn' || maneuver.type === 'fork') return `Turn ${maneuver.modifier || 'ahead'}${road}`;
  return `Continue${road}`;
}
