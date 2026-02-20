function disabled(message = "Admin disabled") {
  return {
    ok: false,
    status: 404,
    json: { ok: false, message },
  };
}

export async function adminUsersList() {
  return disabled();
}

export async function adminBalanceSet() {
  return disabled();
}

export async function adminBanSet() {
  return disabled();
}

export async function adminSettingsGet() {
  return disabled();
}

export async function adminSettingsSet() {
  return disabled();
}