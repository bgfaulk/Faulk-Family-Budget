package com.springapp.mvc.Repository;

import com.springapp.mvc.Beans.LoginModel;

/**
 * LoginDAO interface
 *
 * @author Brian Faulk
 */

public interface LoginDAO
{
    public boolean validate( LoginModel loginModel );
}
