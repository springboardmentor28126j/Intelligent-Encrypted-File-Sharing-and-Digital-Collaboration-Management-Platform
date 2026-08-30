from mongodb import (
    test_mongodb,
    create_activity_log,
    activity_logs
)


if __name__ == "__main__":

    # Test MongoDB connection
    connected = test_mongodb()

    if not connected:
        print("MongoDB is not available.")
        exit()

    # Insert test activity
    create_activity_log(
        user_id=5,
        action="test",
        filename="test.txt"
    )

    print("Activity log inserted successfully.")

    # Read the latest activity
    latest_log = activity_logs.find_one(
        sort=[("_id", -1)]
    )

    print("Latest activity log:")

    print(latest_log)