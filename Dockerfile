FROM node:latest
RUN mkdir -p /var/www
WORKDIR /var/www
COPY ./server/package.json /var/www/package.json
COPY ./server/package-lock.json /var/www/package-lock.json
RUN npm install
COPY ./server /var/www
RUN npm install -g nodemon
EXPOSE 3000
CMD [ "nodemon", "server.js" ]