from sharing import create_share_link, get_share_link


token = create_share_link(
    filename="Shreeram Patil Resume.pdf",
    owner_email="owner@example.com",
    allowed_email="user@example.com",
    permission="download",
    expiry_minutes=0
)

print("Token created:", token)

share, error = get_share_link(
    token,
    "user@example.com"
)

if share:
    print("ERROR: Link should have expired.")
else:
    print("Expired link blocked successfully.")
    print("Reason:", error)