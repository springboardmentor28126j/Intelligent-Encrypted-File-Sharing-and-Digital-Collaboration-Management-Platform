from s3_storage import check_bucket

result = check_bucket()

print(result)

if result["connected"]:
    print("AWS S3 CONNECTION SUCCESSFUL")
else:
    print("AWS S3 CONNECTION FAILED")
    print(result["error"])