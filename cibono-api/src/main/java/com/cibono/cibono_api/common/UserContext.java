package com.cibono.cibono_api.common;

public final class UserContext {
    private UserContext(){}

    // MVP: 로그인 없이 단일 사용자(1번)로 고정
    public static long userId(){
        return 1L;
    }
}
