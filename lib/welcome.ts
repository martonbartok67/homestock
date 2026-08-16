export type WelcomeProfile = {
  name: string;
  tone: "sunshine" | "asshole" | "unc";
};

export function getTimeGreeting(hour: number) {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Good night";
}

export function getPersonalGreeting(hour: number, profile: WelcomeProfile | null) {
  const timeGreeting = getTimeGreeting(hour);
  if (!profile) return timeGreeting;
  if (profile.tone === "sunshine") {
    return `Hey, ${timeGreeting.toLowerCase()} sunshine, ${profile.name}`;
  }
  if (profile.tone === "asshole") return "Hey, asshole";
  return "Hey, unc";
}
