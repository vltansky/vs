export function PreferencesForm() {
  return (
    <form>
      <label>
        Display name
        <input name="displayName" required />
      </label>
      <fieldset>
        <legend>Optional preferences</legend>
        <label>
          Time zone
          <input name="timeZone" />
        </label>
        <label>
          Weekly digest
          <input name="weeklyDigest" type="checkbox" />
        </label>
      </fieldset>
    </form>
  );
}
