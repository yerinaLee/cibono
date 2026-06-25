package com.cibono.cibono_api.common;

public final class UserContext {
	
	private static final ThreadLocal<Long> CURRENT_USER = new ThreadLocal<>();
	private static final ThreadLocal<String> CURRENT_ROLE = new ThreadLocal<>();
	
	private UserContext() {}
	
	public static long userId() {
		Long id = CURRENT_USER.get();
		return id != null ? id : 1L;
	}
	
	public static String role() {
		String r = CURRENT_ROLE.get();
		return r != null ? r : "USER";
	}
	
	public static boolean isAdmin() {
		return "ADMIN".equals(role());
	}
	
	public static void set(Long userId, String role) {
		CURRENT_USER.set(userId);
		CURRENT_ROLE.set(role);
	}
	
	public static void clear() {
		CURRENT_USER.remove();
		CURRENT_ROLE.remove();
	}
	
}
