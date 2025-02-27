certs: clean
	./generate_certs.sh keystorepw keystorepw

run: certs
	docker-compose up -d

clean:
	docker-compose down
	rm -rf certs
	docker image prune -f -a
