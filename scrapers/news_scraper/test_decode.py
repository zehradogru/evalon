import base64, urllib.parse, re
s = 'CBMinwFBVV95cUxNTmF5emVPMklLR2w5bG5lX05ydTdsS0JyQi1rVXktT0htNF9tUC1qU1NCa1RmZmVVcnlyTHdEMjhoVDRGSzduLXd2OWVKV0hhdkdDb3N5R2poTEgySXg3d0F5TTIzS05LNFMtZkttU2RLY0xEdUR3OHA0N1ltV1VNMVNuU2RHOUpWaHJnWkNrOElrTWpob1BCbXh4dlhyOHM'
# pad
missing_padding = len(s) % 4
if missing_padding: s += '=' * (4 - missing_padding)
try:
    b = base64.urlsafe_b64decode(s)
    print("Decoded URL:", b)
except Exception as e:
    print(e)
