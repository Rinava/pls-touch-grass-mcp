const PLAN_B_ACTIVITIES = [
  "stand near an open window and take deep breaths",
  "water a houseplant and observe its leaves",
  "step onto a balcony or porch for 60 seconds",
  "do some light stretching on the floor",
  "open the blinds and let natural light in"
];

export function getPlanB(): string {
  const index = Math.floor(Math.random() * PLAN_B_ACTIVITIES.length);
  const activity = PLAN_B_ACTIVITIES[index];
  
  return `Plan B: ${activity}. (Note: This does not officially count as touching grass, but it's an acceptable substitute during hostile weather!)`;
}
