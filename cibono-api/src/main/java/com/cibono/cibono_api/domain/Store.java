package com.cibono.cibono_api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "store")
public class Store {
	
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;
	
	@Column(name = "name", nullable = false, length = 100)
	private String name;
	
	@Column(name = "region", length = 100)
	private String region;
	
	@Column(name = "source", length = 30)
	private String source;
	
	@Column(name = "store_no", length = 20)
	private String storeNo;
	
	@Column(name = "is_active", nullable = false)
	private Boolean active = true;
	
}
