import { Loader } from '@googlemaps/js-api-loader';

// Use environment variable for API key if available, otherwise use a default key
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyCNtIMCLtz10q3ooMJ-U5OIHCAL48f3atg';

// Create a singleton loader instance
let loaderInstance: any = null;

// Initialize the Google Maps loader
const getLoader = () => {
  if (!loaderInstance) {
    loaderInstance = new Loader({
      apiKey: GOOGLE_MAPS_API_KEY, 
      version: 'weekly',
      libraries: ['places'],
      // Add CSP-compatible settings
      mapIds: ['YOUR_MAP_ID'],
      authReferrerPolicy: 'origin'
    });
  }
  return loaderInstance;
};

// Load Google Maps API
export const loadGoogleMapsApi = async () => {
  try {
    const google = await getLoader().load();
    return google;
  } catch (error) {
    console.error('Error loading Google Maps API:', error);
    throw error;
  }
};

// Calculate distance between two addresses
export const calculateDistance = async (originAddress: string, destinationAddress: string) => {
  try {
    const google = await loadGoogleMapsApi();
    const service = new google.maps.DistanceMatrixService();
    
    const response = await service.getDistanceMatrix({
      origins: [originAddress],
      destinations: [destinationAddress],
      travelMode: google.maps.TravelMode.DRIVING,
      unitSystem: google.maps.UnitSystem.METRIC
    });
    
    if (response.rows[0].elements[0].status === 'OK') {
      return {
        distance: response.rows[0].elements[0].distance,
        duration: response.rows[0].elements[0].duration
      };
    } else {
      throw new Error('Could not calculate distance');
    }
  } catch (error) {
    console.error('Error calculating distance:', error);
    throw error;
  }
};

// Optimize route for multiple destinations
export const optimizeRoute = async (
  startAddress: string, 
  destinationAddresses: string[]
) => {
  try {
    // Use a different loader for routes
    const google = await getLoader(['places', 'routes']).load();
    
    // First, geocode all addresses to get coordinates
    const geocoder = new google.maps.Geocoder();
    
    // Geocode start address
    const startLocation = await new Promise((resolve, reject) => {
      geocoder.geocode({ address: startAddress }, (results, status) => {
        if (status === 'OK') {
          resolve(results[0].geometry.location);
        } else {
          reject(new Error(`Geocoding failed for ${startAddress}: ${status}`));
        }
      });
    });
    
    // Geocode all destination addresses
    const destinationLocations = await Promise.all(
      destinationAddresses.map(address => 
        new Promise((resolve, reject) => {
          geocoder.geocode({ address }, (results, status) => {
            if (status === 'OK') {
              resolve({
                address,
                location: results[0].geometry.location
              });
            } else {
              reject(new Error(`Geocoding failed for ${address}: ${status}`));
            }
          });
        })
      )
    );
    
    // Calculate distances between all points
    const distanceMatrix = await new Promise((resolve, reject) => {
      const service = new google.maps.DistanceMatrixService();
      
      const allAddresses = [startAddress, ...destinationAddresses];
      
      service.getDistanceMatrix({
        origins: allAddresses,
        destinations: allAddresses,
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC
      }, (response, status) => {
        if (status === 'OK') {
          resolve(response);
        } else {
          reject(new Error(`Distance Matrix failed: ${status}`));
        }
      });
    });
    
    // Use a simple nearest neighbor algorithm to find a reasonable route
    // This is a greedy approach and not the optimal TSP solution
    const route = [];
    const visited = new Set();
    let currentPoint = 0; // Start point
    
    route.push({
      address: startAddress,
      location: startLocation
    });
    
    visited.add(0);
    
    // While we haven't visited all points
    while (visited.size < destinationAddresses.length + 1) {
      let nearestPointIndex = -1;
      let shortestDistance = Infinity;
      
      // Find the nearest unvisited point
      for (let i = 0; i < destinationAddresses.length + 1; i++) {
        if (!visited.has(i) && i !== currentPoint) {
          const distance = distanceMatrix.rows[currentPoint].elements[i].distance.value;
          if (distance < shortestDistance) {
            shortestDistance = distance;
            nearestPointIndex = i;
          }
        }
      }
      
      if (nearestPointIndex === -1) break;
      
      // Add the nearest point to our route
      if (nearestPointIndex > 0) { // Skip the start point which is at index 0
        route.push(destinationLocations[nearestPointIndex - 1]);
      }
      
      visited.add(nearestPointIndex);
      currentPoint = nearestPointIndex;
    }
    
    return {
      route,
      totalDistance: route.reduce((total, _, index) => {
        if (index === 0) return 0;
        const fromIndex = index - 1 === 0 ? 0 : route[index - 1].index;
        const toIndex = route[index].index;
        return total + distanceMatrix.rows[fromIndex].elements[toIndex].distance.value;
      }, 0)
    };
  } catch (error) {
    console.error('Error optimizing route:', error);
    throw error;
  }
};

// Get directions between multiple points
export const getDirections = async (
  startAddress: string,
  waypoints: string[],
  endAddress: string
) => {
  try {
    const google = await loadGoogleMapsApi();
    const directionsService = new google.maps.DirectionsService();
    
    const wayPointsObj = waypoints.map(address => ({
      location: address,
      stopover: true
    }));
    
    const response = await directionsService.route({
      origin: startAddress,
      destination: endAddress || startAddress, // Return to start if no end specified
      waypoints: wayPointsObj,
      optimizeWaypoints: true, // Let Google optimize the route
      travelMode: google.maps.TravelMode.DRIVING
    });
    
    return response;
  } catch (error) {
    console.error('Error getting directions:', error);
    throw error;
  }
};

// Render a map with a route
export const renderMap = (
  mapElementId: string,
  directionsResult: any
) => {
  loadGoogleMapsApi().then(google => {
    const map = new google.maps.Map(document.getElementById(mapElementId), {
      zoom: 7,
      center: { lat: 46.8167, lng: 17.7833 }, // Center of Balatonszemes
      mapTypeId: google.maps.MapTypeId.ROADMAP
    });
    
    const directionsRenderer = new google.maps.DirectionsRenderer();
    directionsRenderer.setMap(map);
    directionsRenderer.setDirections(directionsResult);
  }).catch(error => {
    console.error('Error rendering map:', error);
  });
};

// Render a simple map with markers
export const renderSimpleMap = (
  mapElementId: string,
  center: { lat: number, lng: number },
  markers: Array<{ position: { lat: number, lng: number }, title: string, info?: string }>
) => {
  loadGoogleMapsApi().then(google => {
    const map = new google.maps.Map(document.getElementById(mapElementId), {
      zoom: 10,
      center: center,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    });
    
    // Add markers
    markers.forEach(markerData => {
      const marker = new google.maps.Marker({
        position: markerData.position,
        map: map,
        title: markerData.title
      });
      
      // Add info window if info is provided
      if (markerData.info) {
        const infoWindow = new google.maps.InfoWindow({
          content: markerData.info
        });
        
        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });
      }
    });
  }).catch(error => {
    console.error('Error rendering map:', error);
  });
};

// Check for road closures and traffic
export const checkRoadConditions = async (
  startAddress: string,
  endAddress: string
) => {
  try {
    const google = await loadGoogleMapsApi();
    const directionsService = new google.maps.DirectionsService();
    
    const response = await directionsService.route({
      origin: startAddress,
      destination: endAddress,
      travelMode: google.maps.TravelMode.DRIVING,
      drivingOptions: {
        departureTime: new Date(), // Now
        trafficModel: google.maps.TrafficModel.BEST_GUESS
      },
      provideRouteAlternatives: true
    });
    
    // Extract traffic information
    const routes = response.routes.map(route => {
      const leg = route.legs[0];
      return {
        distance: leg.distance.text,
        duration: leg.duration.text,
        durationInTraffic: leg.duration_in_traffic?.text,
        trafficStatus: getTrafficStatus(leg),
        steps: leg.steps.map(step => ({
          instructions: step.instructions,
          distance: step.distance.text,
          duration: step.duration.text
        }))
      };
    });
    
    return {
      bestRoute: routes[0],
      alternatives: routes.slice(1),
      hasTraffic: routes[0].trafficStatus !== 'normal'
    };
  } catch (error) {
    console.error('Error checking road conditions:', error);
    throw error;
  }
};

// Helper function to determine traffic status
function getTrafficStatus(leg: any) {
  if (!leg.duration_in_traffic) return 'unknown';
  
  const normalDuration = leg.duration.value; // in seconds
  const trafficDuration = leg.duration_in_traffic.value; // in seconds
  
  const ratio = trafficDuration / normalDuration;
  
  if (ratio < 1.1) return 'normal';
  if (ratio < 1.3) return 'light';
  if (ratio < 1.5) return 'moderate';
  return 'heavy';
}