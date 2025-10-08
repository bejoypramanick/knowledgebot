# 🔧 Cloudflare Pages Troubleshooting Guide

## 🚨 **Current Issue: Build Command Failing**

### **Error Pattern**
```
13:47:54.818	Failed: error occurred while running build command
```

### **Root Cause Analysis**
The build is failing after the repository clone, which suggests:
1. **Build Command Issue**: The build command might not be properly configured
2. **Environment Variables**: Missing required environment variables
3. **Node.js Version**: Version mismatch or detection issues
4. **Dependencies**: Missing or incompatible dependencies

## ✅ **Complete Solution**

### **1. Use the Build Script**
Instead of the direct command, use the provided build script:

**Build Command**: `./build.sh`

This script provides:
- ✅ Explicit Node.js and npm version logging
- ✅ Step-by-step build process
- ✅ Error handling and validation
- ✅ Build output verification

### **2. Alternative Build Command**
If the script doesn't work, use:
```bash
npm ci && npm run build
```

### **3. Required Environment Variables**
Add these in Cloudflare Pages settings:

```bash
# Essential Build Variables
NODE_VERSION=18.18.0
NPM_CONFIG_PRODUCTION=false
CI=true
NODE_ENV=production

# Vite Configuration
VITE_APP_TITLE=KnowledgeBot
VITE_APP_VERSION=1.0.0
```

## 🔍 **Step-by-Step Fix**

### **Step 1: Update Build Command**
1. Go to Cloudflare Pages Dashboard
2. Select your project
3. Go to **Settings** → **Builds & deployments**
4. Change **Build command** to: `./build.sh`
5. Ensure **Build output directory** is: `dist`

### **Step 2: Add Environment Variables**
1. Go to **Settings** → **Environment variables**
2. Add the variables listed above
3. Make sure they're set for **Production** environment

### **Step 3: Verify Configuration**
- **Framework preset**: Vite
- **Build command**: `./build.sh`
- **Build output directory**: `dist`
- **Root directory**: `/` (empty)
- **Node.js version**: 18.18.0

### **Step 4: Trigger New Deployment**
1. Go to **Deployments** tab
2. Click **"Retry deployment"** or **"Redeploy"**
3. Monitor the build logs

## 📊 **Expected Build Log Output**

### **Successful Build Should Show:**
```
Starting KnowledgeBot build process...
Node.js version: v18.18.0
npm version: 10.9.2
Installing dependencies...
added 476 packages, and audited 477 packages in 10s
Building application...
vite v5.4.20 building for production...
✓ 2609 modules transformed.
✓ built in 2.91s
Build successful! Contents of dist directory:
dist/index.html
dist/assets/
Build completed successfully!
```

### **If Build Fails, Check:**
1. **Node.js Version**: Should be 18.18.0
2. **npm Version**: Should be 10.9.2 or compatible
3. **Dependencies**: All packages should install without errors
4. **Build Output**: dist directory should be created

## 🛠️ **Alternative Solutions**

### **Solution 1: Direct npm Command**
If build script fails, try:
```bash
npm ci && npm run build
```

### **Solution 2: Framework Detection**
1. Set **Framework preset** to **None**
2. Use custom build command: `./build.sh`
3. Set build output directory: `dist`

### **Solution 3: Manual Build Steps**
If all else fails, try:
```bash
npm install
npm run build
```

## 🔄 **Verification Steps**

### **1. Check Build Logs**
- Look for Node.js version detection
- Verify npm install completes successfully
- Confirm Vite build runs without errors
- Check that dist directory is created

### **2. Test Locally**
```bash
# Test the build script
./build.sh

# Or test manually
npm ci
npm run build
```

### **3. Verify Output**
```bash
ls -la dist/
# Should show: index.html, assets/, _headers, etc.
```

## 📞 **Support Resources**

### **Cloudflare Pages Documentation**
- [Build Configuration](https://developers.cloudflare.com/pages/platform/build-configuration/)
- [Environment Variables](https://developers.cloudflare.com/pages/platform/build-configuration/#environment-variables)
- [Troubleshooting](https://developers.cloudflare.com/pages/platform/troubleshooting/)

### **Vite Documentation**
- [Build Configuration](https://vitejs.dev/config/build-options.html)
- [Deployment](https://vitejs.dev/guide/static-deploy.html)

## 🎯 **Quick Fix Checklist**

- [ ] Build command set to `./build.sh`
- [ ] Build output directory set to `dist`
- [ ] Node.js version specified as 18.18.0
- [ ] Environment variables added
- [ ] Framework preset set to Vite
- [ ] New deployment triggered
- [ ] Build logs checked for errors

---

## ✅ **Status: Ready for Testing**

The build script and environment variables are now configured. Try deploying again with the new settings!
