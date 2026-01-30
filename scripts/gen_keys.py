from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
import base64

def b64url(data):
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')

# Generate EC key pair (Prime256v1)
private_key = ec.generate_private_key(ec.SECP256R1())
public_key = private_key.public_key()

# Serialize Public Key (Uncompressed Point format for browser compatibility)
public_bytes = public_key.public_bytes(
    encoding=serialization.Encoding.X962,
    format=serialization.PublicFormat.UncompressedPoint
)
public_b64 = b64url(public_bytes)

# Serialize Private Key (PEM format is safest for backend libs, but base64 of updated private value is also common)
# Let's provide PEM content string (clean, no headers for env var usually one line, but PEM is multiline)
# For VAPID, often the private key is just the scalar value in base64url.
# pywebpush supports PEM.
private_val = private_key.private_numbers().private_value
private_bytes = private_val.to_bytes(32, byteorder='big')
private_b64 = b64url(private_bytes)

print("=" * 60)
print("VAPID KEYS (Generated via cryptography)")
print("=" * 60)
print(f"VAPID_PUBLIC_KEY={public_b64}")
print(f"VAPID_PRIVATE_KEY={private_b64}")
print(f"VAPID_CLAIM_EMAIL=mailto:admin@mxt223.com")
print("=" * 60)
