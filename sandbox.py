from slskd_api import SlskdClient
client = SlskdClient("http://localhost:5030", username="slskd", password="slskd")

#Get all searches with no results
searches=client.searches.get_all()
no_find_searches=[{"artist":search.get("searchText").split(" - ")[0], "title":search.get("searchText").split(" - ")[-1]} for search in searches if search['responseCount']==0]
print({"no_find_searches":no_find_searches, "count":len(no_find_searches)})
#Get all transfers stats
transfers=client.transfers.get_all_downloads(includeRemoved=True)
stats={"albums": {"tried": len(transfers)}, "tracks":{"completed":0,"errored":0, "queued":0, "tried": 0}}
for transfer in transfers:
    for dir in transfer.get("directories", []):
        
        for file in dir.get("files", []):
            if file.get("state")=="Completed, Errored":
                
                stats["tracks"]["errored"]+=1
            elif file.get("state")=="Queued, Remotely":
                stats["tracks"]["queued"]+=1
                
            elif file.get("state")=="Completed, Succeeded":
                stats["tracks"]["completed"]+=1
            stats["tracks"]["tried"]+=1

print(stats)