from slskd_api import SlskdClient
try:
    from app.services.slskd_service import SlskdService
    
    a=SlskdService(
        host="http://192.168.1.31:5030",
        username="slskd",
        password="slskd",
    )
    
    message = "Connection successful"
    success=True
    client=a.client
except Exception as e:
    success = False
    print(e)
# print({"success": success})