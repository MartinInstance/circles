import { generateSecretKey, getPublicKey } from 'nostr-tools'

const SK_KEY      = 'circles:sk'
const NAME_KEY    = 'circles:name'
const COUNTRY_KEY = 'circles:country'

function loadOrCreateSk() {
  const raw = localStorage.getItem(SK_KEY)
  if (raw) return new Uint8Array(JSON.parse(raw))
  const sk = generateSecretKey()
  localStorage.setItem(SK_KEY, JSON.stringify(Array.from(sk)))
  return sk
}

export function getIdentity() {
  const name = localStorage.getItem(NAME_KEY)
  if (!name) return null
  const sk = loadOrCreateSk()
  const pubkey = getPublicKey(sk)
  const country = localStorage.getItem(COUNTRY_KEY) ?? ''
  return { name, country, sk, pubkey }
}

export function setName(name) {
  localStorage.setItem(NAME_KEY, name.trim())
  loadOrCreateSk()
}

export function setCountry(country) {
  localStorage.setItem(COUNTRY_KEY, country.trim())
}

export function hasIdentity() {
  return !!localStorage.getItem(NAME_KEY)
}

export function clearIdentity() {
  localStorage.removeItem(NAME_KEY)
}
