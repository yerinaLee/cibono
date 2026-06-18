package com.cibono.cibono_api.web;

import com.cibono.cibono_api.common.UserContext;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class UserController {

    @GetMapping("/me")
    public Map<String, Object> me() {
        return Map.of(
            "userId", UserContext.userId(),
            "role", UserContext.role()
        );
    }
}
