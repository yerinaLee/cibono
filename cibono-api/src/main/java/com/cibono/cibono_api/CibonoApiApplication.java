package com.cibono.cibono_api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CibonoApiApplication {

	public static void main(String[] args) {
		SpringApplication.run(CibonoApiApplication.class, args);
	}

}
