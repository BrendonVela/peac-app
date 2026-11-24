// Is the voice coach switched on for everyone? (Admin page switch; on if the setting doesn't exist yet)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function voiceAllowed(supabase: any): Promise<boolean> {
  const { data, error } = await supabase.rpc('voice_allowed')
  return error ? true : data !== false
}
