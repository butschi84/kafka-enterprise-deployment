certs: clean
	./generate_certs.sh changeit

run: certs
	docker-compose up -d

clean:
	docker-compose down
	rm -rf certs
