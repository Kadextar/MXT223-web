"""
Generate VAPID keys for web push notifications
"""
from py_vapid import Vapid
import base64

# Generate VAPID keys
vapid = Vapid()
vapid.generate_keys()

# Get keys in the right format
private_pem = vapid.private_pem().decode('utf-8')
# Support both old and new cryptography API (public_bytes_raw vs public_bytes)
pk = vapid.public_key
try:
    public_key = pk.public_bytes_raw()
except AttributeError:
    from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
    public_key = pk.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
public_key_b64 = base64.urlsafe_b64encode(public_key).decode('utf-8').rstrip('=')

print("=" * 60)
print("VAPID KEYS GENERATED")
print("=" * 60)
print("\nAdd these to your .env file:\n")
print(f"VAPID_PUBLIC_KEY={public_key_b64}")
print(f"VAPID_PRIVATE_KEY={private_pem.strip()}")
print(f"VAPID_CLAIM_EMAIL=mailto:admin@mxt223.com")
print("\n" + "=" * 60)
print("\nIMPORTANT: Keep the private key secret!")
print("=" * 60)
print("\n✓ Copy these values to your .env file")
print("\nFor frontend, use the public key in your JavaScript:")
print(f"const VAPID_PUBLIC_KEY = '{public_key_b64}';")
