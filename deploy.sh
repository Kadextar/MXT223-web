#!/bin/bash
echo "Starting deployment..."
git config --global user.email "kadextar@gmail.com"
git config --global user.name "Kadextar"
git add .
git commit -m "feat: Mobile Admin & Optimization v81"
echo "Pushing to server..."
git push origin main
echo "Done! Check your website."
