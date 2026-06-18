package com.cibono.cibono_api.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "app_user")
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "firebase_uid", unique = true)
    private String firebaseUid;

    @Column(name = "email")
    private String email;

    @Column(name = "password_hash")
    private String passwordHash;

    @Column(name = "role", nullable = false)
    private String role = "USER";

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    protected AppUser() {}

    public AppUser(String firebaseUid) {
        this.firebaseUid = firebaseUid;
        this.role = "USER";
    }

    public Long getId() { return id; }
    public String getFirebaseUid() { return firebaseUid; }
    public String getEmail() { return email; }
    public String getRole() { return role; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
