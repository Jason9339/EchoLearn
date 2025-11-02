# Using Cloudflare Tunnel 

# Flow
前端 echo-learn.vercel.app -----CT-----> 自己電腦的後端（worker/ ）

# Setup
## Cloudflare （已經 set 好不用再跑一次）
install Cloudflare (apt / brew .....)  
run the set_tunnel.sh (Beware of the env variable output)  
run the set_tunnel_ingress.sh  
run the set_DNS.sh  

```bash
sh set_tunnel.sh
sh set_tunnel_ingress.sh
sh set_DNS.sh
```

## Python
create virtual enviroment : python3 -m venv .venv/ (Eric's version: Python 3.12.7) 

```bash
python3 -m venv .venv
```

```bash
source .venv/bin/activate
```

```bash
pip install -r requirement.txt
```



# Run
run the Cloudflare Tunnel : run_tunnel.sh
```bash
sh run_tunnel.sh
```
run the python3 backend worker
```bash
python3 app.py
```


# Connect python code
manage by Flask
