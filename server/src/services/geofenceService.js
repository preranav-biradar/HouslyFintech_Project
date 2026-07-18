/**
 * Geofence Service
 * Calculates distance between coordinates and validates against office locations
 */
const { pool } = require('../config/db');
const config = require('../config/env');

/**
 * Calculate distance between two GPS coordinates using the Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Check if given coordinates are within any active office geofence
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Object} { isWithin: boolean, officeName: string|null, distance: number|null }
 */
async function isWithinGeofence(latitude, longitude) {
  if (config.geofence.bypass) {
    return {
      isWithin: true,
      officeId: null,
      officeName: 'Geofence bypass enabled',
      distance: 0,
      radiusMeters: config.geofence.defaultRadiusMeters || 0,
      officeIsActive: false,
      usedActiveQuery: false,
      bypass: true,
    };
  }

  let [offices] = await pool.query(
    'SELECT id, name, latitude, longitude, radius_meters, is_active FROM office_locations WHERE is_active = TRUE'
  );
  let usedActiveQuery = true;

  if (offices.length === 0) {
    [offices] = await pool.query(
      'SELECT id, name, latitude, longitude, radius_meters, is_active FROM office_locations'
    );
    usedActiveQuery = false;
  }

  if (offices.length === 0) {
    return { isWithin: true, officeName: 'No geofence configured', distance: 0, radiusMeters: 0, officeId: null, officeIsActive: false, usedActiveQuery };
  }

  let closestOffice = null;
  let minDistance = Infinity;

  for (const office of offices) {
    const distance = calculateDistance(
      latitude, longitude,
      parseFloat(office.latitude), parseFloat(office.longitude)
    );

    if (distance < minDistance) {
      minDistance = distance;
      closestOffice = office;
    }

    const radius = parseFloat(office.radius_meters) || 0;
    if (distance <= radius) {
      return {
        isWithin: true,
        officeId: office.id,
        officeName: office.name,
        distance: Math.round(distance),
        radiusMeters: radius,
        officeIsActive: office.is_active === 1 || office.is_active === true,
        usedActiveQuery,
      };
    }
  }

  return {
    isWithin: false,
    officeId: closestOffice?.id || null,
    officeName: closestOffice?.name || null,
    distance: Math.round(minDistance),
    radiusMeters: closestOffice ? parseFloat(closestOffice.radius_meters) || 0 : 0,
    officeIsActive: closestOffice ? (closestOffice.is_active === 1 || closestOffice.is_active === true) : false,
    usedActiveQuery,
  };
}

module.exports = { calculateDistance, isWithinGeofence };
