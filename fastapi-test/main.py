from fastapi import FastAPI
from fastapi.responses import JSONResponse
import sys

app = FastAPI()

@app.get("/")
async def root():
    """Check if PyAV is installed"""
    try:
        import av
        pyav_version = av.__version__
        return JSONResponse(
            content={
                "status": "success",
                "pyav_installed": True,
                "pyav_version": pyav_version,
                "message": "PyAV is successfully installed!",
                "python_version": sys.version
            },
            status_code=200
        )
    except ImportError as e:
        return JSONResponse(
            content={
                "status": "error",
                "pyav_installed": False,
                "error": str(e),
                "message": "PyAV is NOT installed",
                "python_version": sys.version
            },
            status_code=200
        )

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy", "service": "FastAPI on Vercel"}

@app.get("/check-packages")
async def check_packages():
    """Check all installed packages"""
    import pkg_resources
    installed_packages = {pkg.key: pkg.version for pkg in pkg_resources.working_set}
    
    pyav_status = "av" in installed_packages or "PyAV" in installed_packages
    
    return {
        "pyav_installed": pyav_status,
        "total_packages": len(installed_packages),
        "av_related": {k: v for k, v in installed_packages.items() if 'av' in k.lower()}
    }
