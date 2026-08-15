export const DEMO = process.argv.includes("--demo");

export const DEMO_LOCATION = { lat: -34.6037, lon: -58.3816, label: "Buenos Aires" };

export const DEMO_WEATHER = { current: { temperature_2m: 22, precipitation: 0, weather_code: 0 } };

export const DEMO_SPOTS = [
  { name: "Parque Centenario", lat: -34.6064, lon: -58.4362, note: "good grass, lots of dogs" },
  { name: "Plaza Irlanda", lat: -34.6156, lon: -58.4522, note: "underrated" },
  { name: "Bosques de Palermo", lat: -34.5711, lon: -58.4167, note: "the classic; there will be joggers and you will feel guilty" },
  { name: "Parque Rivadavia", lat: -34.6186, lon: -58.4325, note: "grass plus used-book stalls, dangerous combo" },
  { name: "Parque Chacabuco", lat: -34.6353, lon: -58.4400, note: "big and quiet, nobody will judge you" },
  { name: "Parque Lezama", lat: -34.6280, lon: -58.3695, note: "historic riverbank slopes, grass on an incline" },
  { name: "Plaza San Martín", lat: -34.5946, lon: -58.3756, note: "the most corporate grass in the city" },
  { name: "Parque Las Heras", lat: -34.5854, lon: -58.4077, note: "picnics, mate, zero shade at noon" },
  { name: "Reserva Ecológica", lat: -34.6100, lon: -58.3520, note: "technically actual nature" },
  { name: "Parque Saavedra", lat: -34.5504, lon: -58.4870, note: "far from everything, which is exactly the point" },
  { name: "Plaza Almagro", lat: -34.6076, lon: -58.4210, note: "small but it delivers" },
  { name: "Barrancas de Belgrano", lat: -34.5601, lon: -58.4470, note: "gazebo, tango on Sundays, diagonal grass" },
  { name: "Parque Patricios", lat: -34.6376, lon: -58.4013, note: "the south side's best-kept secret" },
  { name: "Parque Avellaneda", lat: -34.6437, lon: -58.4790, note: "has a miniature train, nothing else needs saying" },
  { name: "Plaza Houssay", lat: -34.5997, lon: -58.3970, note: "campus grass, finals-week energy" }
];
