package com.example.demo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@SpringBootApplication
@RestController
public class HelloController {

    @GetMapping("/hello")
    public String hello() {
        return "Hello World From Web Application!";
    }

    public static void main(String[] args) {
        SpringApplication.run(HelloController.class, args);
    }
}