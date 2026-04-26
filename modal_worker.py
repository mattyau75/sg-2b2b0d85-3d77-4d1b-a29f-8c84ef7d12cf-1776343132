import os
import subprocess
import sys

def deploy():
    print("🚀 Starting High-Reliability GPU Deployment...")
    
    # 1. Load Env
    env_vars = {}
    try:
        with open(".env.local", "r") as f:
            for line in f:
                if "=" in line and not line.startswith("#"):
                    key, value = line.strip().split("=", 1)
                    env_vars[key] = value.strip("'").strip('"')
    except Exception as e:
        print(f"❌ Error reading .env.local: {e}")
        return

    # 2. Set Env for current process
    os.environ.update(env_vars)
    
    # 3. Verify Essentials
    required = ["MODAL_TOKEN_ID", "MODAL_TOKEN_SECRET"]
    for req in required:
        if req not in os.environ:
            print(f"❌ Missing {req} in .env.local")
            return

    try:
        # 4. Install/Update Modal
        print("📦 Synchronizing Modal SDK...")
        subprocess.run([sys.executable, "-m", "pip", "install", "modal", "--quiet"], check=True)
        
        # 5. Auth
        print("🔑 Authenticating with Modal...")
        subprocess.run([
            sys.executable, "-m", "modal", "token", "set", 
            "--token-id", os.environ["MODAL_TOKEN_ID"], 
            "--token-secret", os.environ["MODAL_TOKEN_SECRET"]
        ], check=True)
        
        # 6. Deploy
        print("☁️  Deploying 'basketball-scout-ai' to GPU Cluster...")
        subprocess.run([sys.executable, "-m", "modal", "deploy", "modal_worker.py"], check=True)
        
        print("✅ SUCCESS: GPU Scouting Worker is live.")
    except subprocess.CalledProcessError as e:
        print(f"❌ Deployment failed with error code {e.returncode}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    deploy()
